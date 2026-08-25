/**
 * 文件职责：验证 AgentSessionRuntime 在新建、恢复、分叉、取消和会话失效前后的生命周期事件顺序。
 * 技术维度：使用 Vitest、假模型提供商、运行时工厂、内联扩展监听器和临时文件会话。
 * 产品维度：让扩展能在会话切换前取消操作、在关闭时清理资源，并在新会话中重新初始化状态。
 * 逻辑维度：createRuntimeHost 装配真实运行时并收集清理函数，各用例记录事件后断言顺序、原因和取消。
 * 关键边界：会话替换后旧扩展上下文必须失效；取消事件不能继续关闭/启动；每个运行时需释放。
 * 新手阅读建议：先看 RecordedSessionEvent 和 createRuntimeHost，再读 new/resume 流程，最后看取消与 fork。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxAssistantMessage, registerFauxProvider } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
} from "../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import type {
	ExtensionFactory,
	SessionBeforeForkEvent,
	SessionBeforeSwitchEvent,
	SessionShutdownEvent,
	SessionStartEvent,
} from "../src/index.ts";

/** 本测试关心的四类会话生命周期事件联合。 */
type RecordedSessionEvent =
	| SessionBeforeSwitchEvent
	| SessionBeforeForkEvent
	| SessionShutdownEvent
	| SessionStartEvent;

/** 覆盖运行时新建、恢复、分叉和上下文失效的生命周期契约。 */
describe("AgentSessionRuntime session lifecycle events", () => {
	/** 当前 describe 注册的运行时清理函数。 */
	const cleanups: Array<() => Promise<void> | void> = [];

	/** 每个用例后执行全部清理。 */
	afterEach(async () => {
		while (cleanups.length > 0) {
			await cleanups.pop()?.();
		}
	});

	/**
	 * 创建加载指定扩展的假模型会话运行时。
	 * @param extensionFactory 注册生命周期监听器的扩展。
	 * @returns 运行时宿主与假提供商。
	 * @example await createRuntimeHost((pi) => {});
	 */
	async function createRuntimeHost(extensionFactory: ExtensionFactory) {
		/** 当前运行时独立使用的临时目录。 */
		const tempDir = join(tmpdir(), `pi-runtime-events-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });

		/** 提供三条固定回复的假模型提供商。 */
		const faux = registerFauxProvider();
		faux.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two"), fauxAssistantMessage("three")]);

		/** 假提供商认证存储。 */
		const authStorage = AuthStorage.inMemory();
		await authStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));
		/** 为运行时提供模型和提供商注册的模型运行时。 */
		const modelRuntime = await ModelRuntime.create({
			credentials: authStorage,
			modelsPath: join(tempDir, "models.json"),
		});
		/** 假提供商默认模型。 */
		const model = faux.getModel();
		modelRuntime.registerProvider(model.provider, {
			baseUrl: model.baseUrl,
			api: model.api,
			models: [
				{
					id: model.id,
					name: model.name,
					api: model.api,
					reasoning: model.reasoning,
					input: model.input,
					cost: model.cost,
					contextWindow: model.contextWindow,
					maxTokens: model.maxTokens,
					baseUrl: model.baseUrl,
				},
			],
		});

		/** 每次会话服务创建复用的模型与资源加载选项。 */
		const runtimeOptions = {
			agentDir: tempDir,
			modelRuntime,
			model: faux.getModel(),
			resourceLoaderOptions: {
				extensionFactories: [extensionFactory],
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};
		/** 新建或替换会话时创建服务和 AgentSession 的工厂。 */
		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			/** 当前会话对应的服务集合。 */
			const services = await createAgentSessionServices({
				...runtimeOptions,
				cwd,
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
		/** 已创建并完成首次扩展绑定的运行时宿主。 */
		const runtimeHost = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.create(tempDir),
		});
		await runtimeHost.session.bindExtensions({});

		cleanups.push(async () => {
			await runtimeHost.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		return { runtimeHost, faux };
	}

	it("emits session_before_switch and session_start for new and resume flows", async () => {
		/** 记录新建与恢复流程事件的数组。 */
		const events: RecordedSessionEvent[] = [];
		const { runtimeHost } = await createRuntimeHost((pi) => {
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
		/** runtimeHost 是装有上述事件监听器的测试运行时，用于驱动新建和恢复流程。 */

		expect(events).toEqual([{ type: "session_start", reason: "startup" }]);
		events.length = 0;

		await runtimeHost.session.prompt("hello");
		/** 初始会话文件路径。 */
		const originalSessionFile = runtimeHost.session.sessionFile;
		expect(originalSessionFile).toBeTruthy();

		/** 新建会话操作结果。 */
		const newSessionResult = await runtimeHost.newSession();
		expect(newSessionResult.cancelled).toBe(false);
		await runtimeHost.session.bindExtensions({});
		/** 新建后的第二会话文件路径。 */
		const secondSessionFile = runtimeHost.session.sessionFile;
		expect(events).toEqual([
			{ type: "session_before_switch", reason: "new", targetSessionFile: undefined },
			{ type: "session_shutdown", reason: "new", targetSessionFile: secondSessionFile },
			{ type: "session_start", reason: "new", previousSessionFile: originalSessionFile },
		]);

		events.length = 0;
		expect(secondSessionFile).toBeTruthy();

		/** 恢复原会话的操作结果。 */
		const switchResult = await runtimeHost.switchSession(originalSessionFile!);
		expect(switchResult.cancelled).toBe(false);
		await runtimeHost.session.bindExtensions({});
		expect(events).toEqual([
			{ type: "session_before_switch", reason: "resume", targetSessionFile: originalSessionFile },
			{ type: "session_shutdown", reason: "resume", targetSessionFile: originalSessionFile },
			{ type: "session_start", reason: "resume", previousSessionFile: secondSessionFile },
		]);
	});

	it("honors session_before_switch cancellation", async () => {
		/** 记录取消新建流程事件的数组。 */
		const events: RecordedSessionEvent[] = [];
		const { runtimeHost } = await createRuntimeHost((pi) => {
			pi.on("session_before_switch", (event) => {
				events.push(event);
				return { cancel: true };
			});
			pi.on("session_start", (event) => {
				events.push(event);
			});
		});
		/** runtimeHost 是会取消切换事件的测试运行时，用于确认取消结果被调用方遵守。 */

		expect(events).toEqual([{ type: "session_start", reason: "startup" }]);
		events.length = 0;

		await runtimeHost.session.prompt("hello");
		/** 取消操作前的原会话文件。 */
		const originalSessionFile = runtimeHost.session.sessionFile;

		/** 被 session_before_switch 取消的新建结果。 */
		const result = await runtimeHost.newSession();
		expect(result.cancelled).toBe(true);
		expect(runtimeHost.session.sessionFile).toBe(originalSessionFile);
		expect(events).toEqual([{ type: "session_before_switch", reason: "new", targetSessionFile: undefined }]);
	});

	it("runs beforeSessionInvalidate after session_shutdown and before rebindSession", async () => {
		/** 记录关闭、失效前回调和重新绑定顺序。 */
		const phases: string[] = [];
		const { runtimeHost } = await createRuntimeHost((pi) => {
			pi.on("session_shutdown", () => {
				phases.push("session_shutdown");
			});
		});
		/** 替换前的旧会话，用于验证失效时机。 */
		const oldSession = runtimeHost.session;
		runtimeHost.setBeforeSessionInvalidate(() => {
			phases.push("beforeSessionInvalidate");
			expect(oldSession.extensionRunner.createContext().cwd).toBe(oldSession.sessionManager.getCwd());
		});
		runtimeHost.setRebindSession(async () => {
			phases.push("rebindSession");
		});

		await runtimeHost.newSession();

		expect(phases).toEqual(["session_shutdown", "beforeSessionInvalidate", "rebindSession"]);
		expect(() => oldSession.extensionRunner.createContext().cwd).toThrow(
			"This extension ctx is stale after session replacement or reload. Do not use a captured pi or command ctx after ctx.newSession(), ctx.fork(), ctx.switchSession(), or ctx.reload(). For newSession, fork, and switchSession, move post-replacement work into withSession and use the ctx passed to withSession. For reload, do not use the old ctx after await ctx.reload().",
		);
		runtimeHost.setBeforeSessionInvalidate(undefined);
		runtimeHost.setRebindSession(undefined);
	});

	it("emits session_before_fork and session_start and honors cancellation", async () => {
		/** 记录 fork 成功与取消流程事件。 */
		const events: RecordedSessionEvent[] = [];
		/** 下一次 fork 是否应由扩展取消。 */
		let cancelNextFork = false;
		const { runtimeHost } = await createRuntimeHost((pi) => {
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
		/** runtimeHost 是带条件式 fork 取消监听器的测试运行时，用于覆盖允许与拒绝两条路径。 */

		expect(events).toEqual([{ type: "session_start", reason: "startup" }]);
		events.length = 0;

		await runtimeHost.session.prompt("hello");
		/** 可供分叉的首条用户消息及条目标识。 */
		const userMessage = runtimeHost.session.getUserMessagesForForking()[0];
		/** 成功分叉前的会话文件。 */
		const previousSessionFile = runtimeHost.session.sessionFile;

		/** 成功 fork 操作结果。 */
		const successResult = await runtimeHost.fork(userMessage.entryId);
		expect(successResult.cancelled).toBe(false);
		expect(successResult.selectedText).toBe("hello");
		await runtimeHost.session.bindExtensions({});
		expect(events).toEqual([
			{ type: "session_before_fork", entryId: userMessage.entryId, position: "before" },
			{ type: "session_shutdown", reason: "fork", targetSessionFile: runtimeHost.session.sessionFile },
			{ type: "session_start", reason: "fork", previousSessionFile },
		]);

		events.length = 0;
		cancelNextFork = true;
		/** 被扩展取消的普通 fork 结果。 */
		const cancelResult = await runtimeHost.fork(userMessage.entryId);
		expect(cancelResult).toEqual({ cancelled: true });
		expect(events).toEqual([{ type: "session_before_fork", entryId: userMessage.entryId, position: "before" }]);

		events.length = 0;
		cancelNextFork = true;
		/** 被扩展提前取消、无需验证条目存在的 position=at 结果。 */
		const cancelAtResult = await runtimeHost.fork("missing-entry", { position: "at" });
		expect(cancelAtResult).toEqual({ cancelled: true });
		expect(events).toEqual([{ type: "session_before_fork", entryId: "missing-entry", position: "at" }]);
	});
});
