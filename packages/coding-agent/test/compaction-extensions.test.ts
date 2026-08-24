import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * Tests for compaction extension events (before_compact / compact).
 */
/**
 * 文件职责：验证会话压缩前后扩展事件的触发、取消、自定义结果、异常回退和多扩展顺序。
 * 技术维度：使用 Vitest、真实 Anthropic 模型、AgentSession、临时会话目录和扩展运行时执行集成测试。
 * 产品维度：确保扩展作者能安全观察或定制长会话压缩，同时不因单个扩展失败破坏用户会话。
 * 逻辑维度：构造事件捕获扩展与测试会话，再分别检查默认压缩、自定义压缩和扩展编排行为。
 * 关键边界：缺少 Anthropic 凭据时整组跳过；测试会访问真实模型且单例超时为 120 秒。
 * 新手阅读建议：先读 createExtension 与 createSession，再比较默认、自定义、取消三类用例，最后看多扩展顺序。
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel, streamSimple } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import {
	createExtensionRuntime,
	type Extension,
	type SessionBeforeCompactEvent,
	type SessionCompactEvent,
	type SessionEvent,
} from "../src/core/extensions/index.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createSyntheticSourceInfo } from "../src/core/source-info.ts";
import { createCodingTools } from "../src/index.ts";
import { createTestResourceLoader } from "./utilities.ts";

/** Anthropic 测试凭据；缺失时跳过需要真实模型的压缩扩展测试。 */
const API_KEY = process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;

describe.skipIf(!API_KEY)("Compaction extensions", () => {
	/** 当前用例创建的会话，在清理阶段释放。 */
	let session: AgentSession;
	/** 当前用例独占的临时目录。 */
	let tempDir: string;
	/** 扩展处理器实际接收到的压缩事件序列。 */
	let capturedEvents: SessionEvent[];

	// 每个用例创建隔离目录并清空事件记录。
	beforeEach(async () => {
		tempDir = join(tmpdir(), `pi-compaction-extensions-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		capturedEvents = [];
	});

	// 每个用例后释放会话并删除临时文件，避免资源泄漏和状态串扰。
	afterEach(async () => {
		if (session) {
			session.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	/** 创建可注入压缩前后回调的测试扩展。参数分别处理两个事件；返回完整 Extension。例如：createExtension(() => ({ cancel: true }))。 */
	function createExtension(
		onBeforeCompact?: (event: SessionBeforeCompactEvent) => { cancel?: boolean; compaction?: any } | undefined,
		onCompact?: (event: SessionCompactEvent) => void,
	): Extension {
		/** 按事件名保存异步扩展处理器的注册表。 */
		const handlers = new Map<string, ((event: any, ctx: any) => Promise<any>)[]>();

		handlers.set("session_before_compact", [
			async (event: SessionBeforeCompactEvent) => {
				capturedEvents.push(event);
				if (onBeforeCompact) {
					return onBeforeCompact(event);
				}
				return undefined;
			},
		]);

		handlers.set("session_compact", [
			async (event: SessionCompactEvent) => {
				capturedEvents.push(event);
				if (onCompact) {
					onCompact(event);
				}
				return undefined;
			},
		]);

		return {
			path: "test-extension",
			resolvedPath: "/test/test-extension.ts",
			sourceInfo: createSyntheticSourceInfo("<test:test-extension>", { source: "test" }),
			handlers,
			tools: new Map(),
			messageRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		};
	}

	/** 使用指定扩展创建可压缩测试会话。参数 extensions 为加载列表；返回并保存 AgentSession。例如：await createSession([extension])。 */
	async function createSession(extensions: Extension[]) {
		/** 测试使用的 Anthropic Sonnet 模型定义。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 执行真实流式请求的底层代理。 */
		const agent = new Agent({
			getApiKey: () => API_KEY,
			streamFn: streamSimple,
			initialState: {
				model,
				systemPrompt: "You are a helpful assistant. Be concise.",
				tools: createCodingTools(process.cwd()),
			},
		});

		/** 将会话记录写入临时目录的管理器。 */
		const sessionManager = SessionManager.create(tempDir);
		/** 配置压缩阈值的临时设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		/** 指向临时认证文件的存储对象。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 为会话提供模型与认证查询的注册表。 */
		const modelRegistry = await createModelRegistry(authStorage);

		/** 本用例扩展共享的运行时状态。 */
		const runtime = createExtensionRuntime();
		/** 在默认测试资源加载器上覆盖扩展来源的加载器。 */
		const resourceLoader = {
			...createTestResourceLoader(),
			getExtensions: () => ({ extensions, errors: [], runtime }),
		};

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader,
		});

		return session;
	}

	// 默认压缩应依次发出压缩前和压缩后事件，并携带完整数据。
	it("should emit before_compact and compact events", async () => {
		/** 只捕获事件、不修改压缩行为的扩展。 */
		const extension = createExtension();
		await createSession([extension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.compact();

		/** 捕获到的所有压缩前事件。 */
		const beforeCompactEvents = capturedEvents.filter(
			(e): e is SessionBeforeCompactEvent => e.type === "session_before_compact",
		);
		/** 捕获到的所有压缩完成事件。 */
		const compactEvents = capturedEvents.filter((e): e is SessionCompactEvent => e.type === "session_compact");

		expect(beforeCompactEvents.length).toBe(1);
		expect(compactEvents.length).toBe(1);

		/** 唯一的压缩前事件。 */
		const beforeEvent = beforeCompactEvents[0];
		expect(beforeEvent.preparation).toBeDefined();
		expect(beforeEvent.preparation.messagesToSummarize).toBeDefined();
		expect(beforeEvent.preparation.turnPrefixMessages).toBeDefined();
		expect(beforeEvent.preparation.tokensBefore).toBeGreaterThanOrEqual(0);
		expect(typeof beforeEvent.preparation.isSplitTurn).toBe("boolean");
		expect(beforeEvent.branchEntries).toBeDefined();
		// sessionManager, modelRegistry, and model are now on ctx, not event
		// sessionManager、modelRegistry 和 model 已移动到上下文，不再直接放在事件上。

		/** 唯一的压缩完成事件。 */
		const afterEvent = compactEvents[0];
		expect(afterEvent.compactionEntry).toBeDefined();
		expect(afterEvent.compactionEntry.summary.length).toBeGreaterThan(0);
		expect(afterEvent.compactionEntry.tokensBefore).toBeGreaterThanOrEqual(0);
		expect(afterEvent.fromExtension).toBe(false);
	}, 120000);

	// 扩展返回 cancel 时应拒绝压缩，且不再发出完成事件。
	it("should allow extensions to cancel compaction", async () => {
		/** 始终取消压缩的测试扩展。 */
		const extension = createExtension(() => ({ cancel: true }));
		await createSession([extension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await expect(session.compact()).rejects.toThrow("Compaction cancelled");

		/** 被取消流程中捕获的压缩完成事件，预期为空。 */
		const compactEvents = capturedEvents.filter((e) => e.type === "session_compact");
		expect(compactEvents.length).toBe(0);
	}, 120000);

	// 扩展可提供自定义摘要并被标记为扩展生成。
	it("should allow extensions to provide custom compaction", async () => {
		/** 扩展返回并由断言核对的固定摘要。 */
		const customSummary = "Custom summary from extension";

		/** 在压缩前事件中返回自定义压缩结果的扩展。 */
		const extension = createExtension((event) => {
			if (event.type === "session_before_compact") {
				return {
					compaction: {
						summary: customSummary,
						firstKeptEntryId: event.preparation.firstKeptEntryId,
						tokensBefore: event.preparation.tokensBefore,
					},
				};
			}
			return undefined;
		});
		await createSession([extension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		/** 会话采用扩展结果后返回的压缩数据。 */
		const result = await session.compact();

		expect(result.summary).toBe(customSummary);

		/** 自定义压缩后捕获的完成事件。 */
		const compactEvents = capturedEvents.filter((e) => e.type === "session_compact");
		expect(compactEvents.length).toBe(1);

		/** 包含自定义摘要的压缩完成事件。 */
		const afterEvent = compactEvents[0];
		if (afterEvent.type === "session_compact") {
			expect(afterEvent.compactionEntry.summary).toBe(customSummary);
			expect(afterEvent.fromExtension).toBe(true);
		}
	}, 120000);

	// 压缩完成事件触发时，压缩条目应已保存到会话树。
	it("should include entries in compact event after compaction is saved", async () => {
		/** 使用默认压缩的事件捕获扩展。 */
		const extension = createExtension();
		await createSession([extension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.compact();

		/** 当前用例捕获的压缩完成事件。 */
		const compactEvents = capturedEvents.filter((e) => e.type === "session_compact");
		expect(compactEvents.length).toBe(1);

		/** 触发会话条目检查的压缩完成事件。 */
		const afterEvent = compactEvents[0];
		if (afterEvent.type === "session_compact") {
			// sessionManager is now on ctx, use session.sessionManager directly
			// sessionManager 已位于上下文中，测试直接从 session 访问。
			/** 压缩完成后会话管理器中的全部条目。 */
			const entries = session.sessionManager.getEntries();
			/** 条目列表中是否已有 compaction 记录。 */
			const hasCompactionEntry = entries.some((e: { type: string }) => e.type === "compaction");
			expect(hasCompactionEntry).toBe(true);
		}
	}, 120000);

	// 压缩前处理器抛错时仍应回退到默认压缩并发出完成事件。
	it("should continue with default compaction if extension throws error", async () => {
		/** 压缩前故意抛错、压缩后继续记录事件的扩展。 */
		const throwingExtension: Extension = {
			path: "throwing-extension",
			resolvedPath: "/test/throwing-extension.ts",
			sourceInfo: createSyntheticSourceInfo("<test:throwing-extension>", { source: "test" }),
			handlers: new Map<string, ((event: any, ctx: any) => Promise<any>)[]>([
				[
					"session_before_compact",
					[
						async (event: SessionBeforeCompactEvent) => {
							capturedEvents.push(event);
							throw new Error("Extension intentionally throws");
						},
					],
				],
				[
					"session_compact",
					[
						async (event: SessionCompactEvent) => {
							capturedEvents.push(event);
							return undefined;
						},
					],
				],
			]),
			tools: new Map(),
			messageRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		};

		await createSession([throwingExtension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		/** 扩展失败后由默认实现生成的压缩结果。 */
		const result = await session.compact();

		expect(result.summary).toBeDefined();
		expect(result.summary.length).toBeGreaterThan(0);

		/** 异常回退后捕获的压缩完成事件。 */
		const compactEvents = capturedEvents.filter((e): e is SessionCompactEvent => e.type === "session_compact");
		expect(compactEvents.length).toBe(1);
		expect(compactEvents[0].fromExtension).toBe(false);
	}, 120000);

	// 多扩展应按注册顺序分别执行压缩前处理器和压缩后处理器。
	it("should call multiple extensions in order", async () => {
		/** 所有处理器的实际调用顺序。 */
		const callOrder: string[] = [];

		/** 记录第一组 before/after 标记的扩展。 */
		const extension1: Extension = {
			path: "extension1",
			resolvedPath: "/test/extension1.ts",
			sourceInfo: createSyntheticSourceInfo("<test:extension1>", { source: "test" }),
			handlers: new Map<string, ((event: any, ctx: any) => Promise<any>)[]>([
				[
					"session_before_compact",
					[
						async () => {
							callOrder.push("extension1-before");
							return undefined;
						},
					],
				],
				[
					"session_compact",
					[
						async () => {
							callOrder.push("extension1-after");
							return undefined;
						},
					],
				],
			]),
			tools: new Map(),
			messageRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		};

		/** 记录第二组 before/after 标记的扩展。 */
		const extension2: Extension = {
			path: "extension2",
			resolvedPath: "/test/extension2.ts",
			sourceInfo: createSyntheticSourceInfo("<test:extension2>", { source: "test" }),
			handlers: new Map<string, ((event: any, ctx: any) => Promise<any>)[]>([
				[
					"session_before_compact",
					[
						async () => {
							callOrder.push("extension2-before");
							return undefined;
						},
					],
				],
				[
					"session_compact",
					[
						async () => {
							callOrder.push("extension2-after");
							return undefined;
						},
					],
				],
			]),
			tools: new Map(),
			messageRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		};

		await createSession([extension1, extension2]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.compact();

		expect(callOrder).toEqual(["extension1-before", "extension2-before", "extension1-after", "extension2-after"]);
	}, 120000);

	// 压缩前事件应暴露准备数据和当前分支条目，运行时能力仍由 session 提供。
	it("should pass correct data in before_compact event", async () => {
		/** 回调捕获的压缩前事件；调用前为 null。 */
		let capturedBeforeEvent: SessionBeforeCompactEvent | null = null;

		/** 将压缩前事件保存给用例断言的扩展。 */
		const extension = createExtension((event) => {
			capturedBeforeEvent = event;
			return undefined;
		});
		await createSession([extension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.compact();

		expect(capturedBeforeEvent).not.toBeNull();
		/** 经过非空断言后的压缩前事件。 */
		const event = capturedBeforeEvent!;
		expect(typeof event.preparation.isSplitTurn).toBe("boolean");
		expect(event.preparation.firstKeptEntryId).toBeDefined();

		expect(Array.isArray(event.preparation.messagesToSummarize)).toBe(true);
		expect(Array.isArray(event.preparation.turnPrefixMessages)).toBe(true);

		expect(typeof event.preparation.tokensBefore).toBe("number");

		expect(Array.isArray(event.branchEntries)).toBe(true);

		// sessionManager and model runtime remain available on the session.
		// sessionManager 与模型运行时仍可从 session 实例访问。
		expect(typeof session.sessionManager.getEntries).toBe("function");
		expect(typeof session.modelRuntime.getAuth).toBe("function");

		/** 当前会话分支中的持久化条目。 */
		const entries = session.sessionManager.getEntries();
		expect(Array.isArray(entries)).toBe(true);
		expect(entries.length).toBeGreaterThan(0);
	}, 120000);

	// 扩展提供的非默认 tokensBefore 值也应被原样采用。
	it("should use extension compaction even with different values", async () => {
		/** 用于确认扩展值优先级的自定义摘要。 */
		const customSummary = "Custom summary with modified values";

		/** 返回自定义摘要和固定 Token 数的扩展。 */
		const extension = createExtension((event) => {
			if (event.type === "session_before_compact") {
				return {
					compaction: {
						summary: customSummary,
						firstKeptEntryId: event.preparation.firstKeptEntryId,
						tokensBefore: 999,
					},
				};
			}
			return undefined;
		});
		await createSession([extension]);

		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		/** 预期完整保留扩展字段的压缩结果。 */
		const result = await session.compact();

		expect(result.summary).toBe(customSummary);
		expect(result.tokensBefore).toBe(999);
	}, 120000);
});
